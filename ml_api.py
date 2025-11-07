from flask import Flask, request, jsonify
import pickle
import numpy as np
import os

app = Flask(__name__)
MODEL_PATH = "classifier.pkl"

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

with open(MODEL_PATH, "rb") as f:
    model = pickle.load(f)

@app.route("/predict", methods=["POST"])
def predict():
    payload = request.get_json(force=True)
    print("\n[ML API] Received payload:", payload)

    # ✅ Accept both {features: {...}} or flat {...}
    features = payload.get("features", payload) if isinstance(payload, dict) else {}
    print("[ML API] Parsed features:", features)

    symptom_text = str(features.get("symptomText", "")).lower()
    severity = str(features.get("severity", "")).lower()
    common_symptoms = features.get("commonSymptoms", []) or []

    feature_names = [
        "mdvp_fo","mdvp_fhi","mdvp_flo","mdvp_jitter","mdvp_jitter_abs",
        "mdvp_rap","mdvp_ppq","jitter_ddp","mdvp_shimmer","mdvp_shimmer_db",
        "shimmer_apq3","shimmer_apq5","mdvp_apq","shimmer_dda","nhr",
        "hnr","rpde","dfa","spread1","spread2","d2","ppe"
    ]

    try:
        X_raw = [float(features.get(f, 0)) for f in feature_names]
        X = np.array([X_raw])
    except Exception as e:
        print("[ML API] Error converting numeric features:", e)
        return jsonify({"error": "Invalid numeric feature values", "detail": str(e)}), 400

    non_zero_count = sum(1 for v in X_raw if v != 0)
    print(f"[ML API] Non-zero numeric features count: {non_zero_count}")

    # ---------- Symptom-based heuristic ----------
    pd_keywords = {"tremor","rigidity","bradykinesia","slowness","masked face","postural instability","shuffling","speech"}
    symptom_matches = sum(1 for kw in pd_keywords if kw in symptom_text or kw in common_symptoms)
    print(f"[ML API] Symptom matches: {symptom_matches}, severity: {severity}")

    if (symptom_matches >= 1 and severity in ("mild", "moderate", "severe")) or (len([s for s in common_symptoms if s in pd_keywords]) >= 2):
        heuristic_prob = min(0.95, 0.65 + 0.1 * min(2, symptom_matches))
        print(f"[ML API] Heuristic triggered -> returning predicted=1 probability={heuristic_prob:.2f}")
        return jsonify({"prediction": 1, "probability": float(heuristic_prob)})

    # ---------- ML Model ----------
    NUMERIC_THRESHOLD = 5  # lowered for easier testing
    if non_zero_count >= NUMERIC_THRESHOLD:
        try:
            pred = model.predict(X)[0]
            prob = float(model.predict_proba(X)[0][1]) if hasattr(model, "predict_proba") else 1.0
            print(f"[ML API] Model used -> prediction: {pred}, probability: {prob:.4f}")
            return jsonify({"prediction": int(pred), "probability": float(prob)})
        except Exception as e:
            print("[ML API] Model prediction failed:", e)
            return jsonify({"error": "Model prediction failed", "detail": str(e)}), 500

    # ---------- Fallback ----------
    print("[ML API] Not enough numeric features or heuristic not triggered -> returning non-Parkinson's")
    return jsonify({"prediction": 0, "probability": 0.0})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
