/* ===========================
   Main app JS (all features)
   =========================== */

/* --- Basic UI elements --- */
const form = document.getElementById("symptomForm");
const symptomInput = document.getElementById("symptomText");
const severitySelect = document.getElementById("severity");
const resultPopup = document.getElementById("resultPopup");
const resultDesc = document.getElementById("resultDesc");
const closeResultBtn = document.getElementById("closeResult");
const startBtn = document.getElementById("startDiagnosisBtn");
const numericSection = document.querySelector(".numeric-features");
const toggleNumericBtn = document.querySelector(".toggle-numeric-btn");
const probabilityBar = document.getElementById("probabilityBar");

/* Dashboard elements */
const viewDashboardBtn = document.getElementById("viewDashboardBtn");
const dashboardSection = document.getElementById("dashboardSection");
const closeDashboardBtn = document.getElementById("closeDashboard");
const clearHistoryBtn = document.getElementById("clearHistory");
const totalTestsEl = document.getElementById("totalTests");
const positiveTestsEl = document.getElementById("positiveTests");
const negativeTestsEl = document.getElementById("negativeTests");
const historyTableBody = document.querySelector("#historyTable tbody");

let pieChart = null;
let barChart = null;

/* Dark mode */
const darkToggle = document.getElementById("darkModeToggle");

/* Voice input */
const voiceBtn = document.getElementById("voiceBtn");
const voiceStatus = document.getElementById("voiceStatus");
let recognition = null;
let recognizing = false;

/* Chatbot */
const chatToggle = document.getElementById("chatToggle");
const chatBox = document.getElementById("chatBox");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendChat = document.getElementById("sendChat");
const closeChat = document.getElementById("closeChat");

/* --------------------------
   Utilities: localStorage
   -------------------------- */
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem("parkinsonResults") || "[]");
  } catch {
    return [];
  }
}
function saveHistory(history) {
  localStorage.setItem("parkinsonResults", JSON.stringify(history));
}

/* --------------------------
   Dark Mode logic
   -------------------------- */
function applyTheme(saved) {
  if (saved === "dark" || (saved === null && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}
const savedTheme = localStorage.getItem("theme");
applyTheme(savedTheme);
darkToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const mode = document.body.classList.contains("dark") ? "dark" : "light";
  localStorage.setItem("theme", mode);
});

/* --------------------------
   Numeric features toggle
   -------------------------- */
toggleNumericBtn.addEventListener("click", () => {
  const shown = numericSection.style.display !== "none";
  numericSection.style.display = shown ? "none" : "block";
  toggleNumericBtn.textContent = shown ? "Show Advanced Features" : "Hide Advanced Features";
});

/* --------------------------
   Voice input (Web Speech API)
   -------------------------- */
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    recognizing = true;
    voiceStatus.textContent = "Listening...";
    voiceBtn.classList.add("listening");
  };
  recognition.onend = () => {
    recognizing = false;
    voiceStatus.textContent = "";
    voiceBtn.classList.remove("listening");
  };
  recognition.onerror = (e) => {
    recognizing = false;
    voiceStatus.textContent = "Voice error";
    console.error("Speech recognition error", e);
    setTimeout(()=> voiceStatus.textContent = "", 1500);
  };
  recognition.onresult = (e) => {
    const t = e.results[0][0].transcript;
    symptomInput.value = (symptomInput.value ? symptomInput.value + " " : "") + t;
    voiceStatus.textContent = "Captured";
    setTimeout(()=> voiceStatus.textContent = "", 1200);
  };

  voiceBtn.addEventListener("click", () => {
    if (recognizing) {
      recognition.stop();
      recognizing = false;
      return;
    }
    try {
      recognition.start();
    } catch (err) {
      console.warn("Recognition start error", err);
    }
  });

} else {
  // hide voice button if not supported
  voiceBtn.style.display = "none";
}

/* --------------------------
   Form submit & backend call
   -------------------------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!symptomInput.value.trim()) return alert("Please enter symptoms");
  if (!severitySelect.value) return alert("Please select severity");

  // Collect inputs
  const features = {
    symptomText: symptomInput.value.trim().toLowerCase(),
    severity: severitySelect.value,
    commonSymptoms: [...form.querySelectorAll('input[name="commonSymptoms"]:checked')].map(c => c.value),

    mdvp_fo: parseFloat(document.getElementById("mdvp_fo").value) || 0,
    mdvp_fhi: parseFloat(document.getElementById("mdvp_fhi").value) || 0,
    mdvp_flo: parseFloat(document.getElementById("mdvp_flo").value) || 0,
    mdvp_jitter: parseFloat(document.getElementById("mdvp_jitter").value) || 0,
    mdvp_jitter_abs: parseFloat(document.getElementById("mdvp_jitter_abs").value) || 0,
    mdvp_rap: parseFloat(document.getElementById("mdvp_rap").value) || 0,
    mdvp_ppq: parseFloat(document.getElementById("mdvp_ppq").value) || 0,
    jitter_ddp: parseFloat(document.getElementById("jitter_ddp").value) || 0,
    mdvp_shimmer: parseFloat(document.getElementById("mdvp_shimmer").value) || 0,
    mdvp_shimmer_db: parseFloat(document.getElementById("mdvp_shimmer_db").value) || 0,
    shimmer_apq3: parseFloat(document.getElementById("shimmer_apq3").value) || 0,
    shimmer_apq5: parseFloat(document.getElementById("shimmer_apq5").value) || 0,
    mdvp_apq: parseFloat(document.getElementById("mdvp_apq").value) || 0,
    shimmer_dda: parseFloat(document.getElementById("shimmer_dda").value) || 0,
    nhr: parseFloat(document.getElementById("nhr").value) || 0,
    hnr: parseFloat(document.getElementById("hnr").value) || 0,
    rpde: parseFloat(document.getElementById("rpde").value) || 0,
    dfa: parseFloat(document.getElementById("dfa").value) || 0,
    spread1: parseFloat(document.getElementById("spread1").value) || 0,
    spread2: parseFloat(document.getElementById("spread2").value) || 0,
    d2: parseFloat(document.getElementById("d2").value) || 0,
    ppe: parseFloat(document.getElementById("ppe").value) || 0
  };

  console.log("[frontend] Sending features to backend:", features);

  try {
    // call backend prediction endpoint
    const res = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(features)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.error || err.message || "Server error");
    }

    const data = await res.json();
    console.log("[frontend] Response from backend:", data);

    const pred = Number(data.prediction);
    const prob = data.probability ? Number(data.probability) : 0;

    let humanText = "";
    if (pred === 1) {
      humanText = `🔴 Parkinson's suspected — Probability: ${(prob * 100).toFixed(1)}%`;
      probabilityBar.style.backgroundColor = getComputedStyle(document.body).getPropertyValue('--bad') || '#ef4444';
    } else {
      humanText = `🟢 No Parkinson's detected — Probability: ${(prob * 100).toFixed(1)}%`;
      probabilityBar.style.backgroundColor = getComputedStyle(document.body).getPropertyValue('--good') || '#06d6a0';
    }

    resultDesc.textContent = humanText;
    resultPopup.classList.add("show");
    resultPopup.focus();

    // Animate probability bar
    probabilityBar.style.width = "0%";
    setTimeout(() => {
      probabilityBar.style.width = `${prob * 100}%`;
    }, 200);

    // Save to dashboard / history
    savePredictionResult(pred, Math.round(prob * 100), severitySelect.value);

  } catch (err) {
    console.error("[frontend] Error:", err);
    alert("Error connecting to backend: " + (err.message || "unknown"));
  }
});

/* --------------------------
   Result popup controls
   -------------------------- */
closeResultBtn.addEventListener("click", () => {
  resultPopup.classList.remove("show");
});

startBtn.addEventListener("click", () => {
  document.querySelector(".symptom-form-section").scrollIntoView({ behavior: "smooth" });
  symptomInput.focus();
});

/* --------------------------
   Dashboard logic & storage
   -------------------------- */
function savePredictionResult(prediction, probabilityPercent, severity) {
  const history = loadHistory();
  history.unshift({
    date: new Date().toLocaleString(),
    prediction: Number(prediction),
    probability: Number(probabilityPercent),
    severity: severity || 'unknown'
  });
  // keep max 100 items
  if (history.length > 100) history.splice(100);
  saveHistory(history);
  renderDashboard();
}

function renderDashboard() {
  const results = loadHistory();
  const total = results.length;
  const positive = results.filter(r => r.prediction === 1).length;
  const negative = total - positive;

  totalTestsEl.textContent = total;
  positiveTestsEl.textContent = positive;
  negativeTestsEl.textContent = negative;

  // build history table
  historyTableBody.innerHTML = "";
  results.slice(0, 20).forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${idx + 1}</td>
                    <td>${r.date}</td>
                    <td>${r.prediction === 1 ? "Parkinson's" : "No Parkinson's"} (${r.severity})</td>
                    <td>${r.probability}</td>`;
    historyTableBody.appendChild(tr);
  });

  // Charts
  const pieCtx = document.getElementById("pieChart").getContext("2d");
  const barCtx = document.getElementById("barChart").getContext("2d");

  if (pieChart) pieChart.destroy();
  if (barChart) barChart.destroy();

  pieChart = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: ["Parkinson's", "No Parkinson's"],
      datasets: [{
        data: [positive, negative],
        backgroundColor: [getComputedStyle(document.body).getPropertyValue('--bad').trim() || '#ef4444', getComputedStyle(document.body).getPropertyValue('--good').trim() || '#06d6a0']
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Result Ratio' } }
    }
  });

  // Bar chart: probability over time (last 20)
  const labels = results.slice(0, 20).map(r => r.date.split(",")[0]);
  const probs = results.slice(0, 20).map(r => r.probability);
  barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Probability (%)',
        data: probs,
        backgroundColor: getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#4f46e5'
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, max: 100 } },
      plugins: { legend: { display: false }, title: { display: true, text: 'Predicted Probability Over Time' } }
    }
  });
}

/* Button interactions for dashboard */
viewDashboardBtn.addEventListener("click", () => {
  dashboardSection.style.display = "block";
  dashboardSection.scrollIntoView({ behavior: "smooth" });
  renderDashboard();
});

closeDashboardBtn.addEventListener("click", () => {
  dashboardSection.style.display = "none";
});

clearHistoryBtn.addEventListener("click", () => {
  if (!confirm("Clear all stored history?")) return;
  saveHistory([]);
  renderDashboard();
});

/* --------------------------
   Chatbot simple local Q&A
   -------------------------- */
chatToggle.addEventListener("click", () => {
  const showing = chatBox.style.display === "block";
  chatBox.style.display = showing ? "none" : "block";
});
closeChat.addEventListener("click", () => chatBox.style.display = "none");

const canned = [
  { q: "what is parkinson", a: "Parkinson's disease is a progressive nervous system disorder that affects movement. Common signs include tremor, stiffness, and slow movement."},
  { q: "symptoms", a: "Common symptoms: tremor, bradykinesia (slowness), rigidity, postural instability, speech changes, masked face."},
  { q: "how accurate", a: "Accuracy depends on the model and data. This app shows a probability — always consult a medical professional for diagnosis."},
  { q: "how to use", a: "Enter symptoms or use the microphone, select severity, and click Detect. Use the Dashboard to view past results."}
];

function addChatMessage(who, text) {
  const div = document.createElement("div");
  div.className = "msg";
  div.innerHTML = `<strong>${who}:</strong> ${text}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendChat.addEventListener("click", () => {
  const text = (chatInput.value || "").trim();
  if (!text) return;
  addChatMessage("You", text);
  const q = text.toLowerCase();
  const match = canned.find(c => q.includes(c.q));
  if (match) {
    setTimeout(()=> addChatMessage("Assistant", match.a), 300);
  } else {
    setTimeout(()=> addChatMessage("Assistant", "Sorry — I don't know that. Try: 'symptoms', 'how to use', or 'what is parkinson'."), 400);
  }
  chatInput.value = "";
});
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat.click(); });


/* --------------------------
   Init: load any stored data and render minimal UI
   -------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // ensure dashboard hidden until user opens
  dashboardSection.style.display = "none";
  // render if there is data
  if (loadHistory().length > 0) {
    // pre-render charts only if user opens dashboard; but keep counts updated
    const results = loadHistory();
    totalTestsEl.textContent = results.length;
    positiveTestsEl.textContent = results.filter(r => r.prediction === 1).length;
    negativeTestsEl.textContent = results.length - positiveTestsEl.textContent;
  }
});

// ===============================
// CONTACT FORM FRONTEND SCRIPT
// ===============================

// Wait for the page to load
document.addEventListener("DOMContentLoaded", () => {
  const contactForm = document.getElementById("contactForm");

  // If form not found, do nothing
  if (!contactForm) return;

  // Attach form submit listener
  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Collect form data
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = document.getElementById("message").value.trim();

    // Validate
    if (!name || !email || !message) {
      alert("⚠️ Please fill in all fields before submitting.");
      return;
    }

    // Create payload object
    const formData = { name, email, message };

    try {
      // Send POST request to backend
      const response = await fetch("http://127.0.0.1:8000/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to send message.");
      }

      const data = await response.json();
      console.log("✅ Contact form response:", data);

      // Show success message to user
      alert("✅ Message sent successfully! Thank you for contacting us.");

      // Clear the form
      contactForm.reset();

    } catch (err) {
      console.error("❌ Error sending message:", err);
      alert("❌ Failed to send your message. Please try again later.");
    }
  });
});
