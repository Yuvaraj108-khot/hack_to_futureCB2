import sys
from pathlib import Path


local_deps = Path(__file__).resolve().parent / ".pythonlibs"
if local_deps.exists():
    sys.path.insert(0, str(local_deps))

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File as FastAPIFile
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlalchemy.orm import Session
import os

load_dotenv()

from database import SessionLocal, engine, get_db, Base
from models.db_models import ClaimRecord, EvidenceRecord
from models.domain import VerifyRequest, VerifyResponse, Source, ThreatCard, RiskMetrics
from services.nlp_service import NLPService
from services.search_service import SearchService
from services.llm_service import LLMService
from services.stance_service import StanceService
from services.risk_analyzer import RiskAnalyzer
from services.media_service import MediaService

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="VAULTX Intelligence API")

# Configure CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://hack-to-futurecb2-1.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Services
search_service = SearchService()
llm_service = LLMService()
stance_service = StanceService()
risk_analyzer = RiskAnalyzer()
media_service = MediaService()

@app.post("/api/verify", response_model=VerifyResponse)
async def verify_claim(request: VerifyRequest, db: Session = Depends(get_db)):
    raw_text = request.text

    # 1. Translate & Linguistic Risk Analysis
    translated_text = await llm_service.translate_text(raw_text)
    risk_report = risk_analyzer.analyze(translated_text)

    # 2. Extract Claim (Stage 1)
    extraction = await llm_service.extract_claim(translated_text)
    claim = extraction.get("atomic_claim", translated_text)
    category = "General"

    # 3. Parallel Web Search
    search_results = await search_service.parallel_search(claim)

    # 4. Evidence Synthesis
    synthesis = await llm_service.synthesize_evidence(claim, search_results)

    # 5. Stance & Dissent Check (Stage 2)
    stance_data = await stance_service.analyze_stance(raw_text, claim)

    # Build Sources List
    sources = []
    seen_urls = set()
    for res in search_results:
        url = res.get("url", "")
        if url and url not in seen_urls:
            sources.append(Source(url=url, title=res.get("title", "Source")))
            seen_urls.add(url)

    threat_card = None
    if synthesis.get("threat_tactic") and synthesis.get("threat_tactic") != "None":
        threat_card = ThreatCard(
            tactic=synthesis.get("threat_tactic"),
            technique=synthesis.get("threat_technique", "Unknown")
        )

    verdict = synthesis.get("verdict", "UNVERIFIABLE")
    confidence = float(synthesis.get("confidence", 0.0))

    # 6. Persistence
    db_claim = ClaimRecord(
        text=raw_text,
        translated_text=translated_text,
        verdict=verdict,
        confidence=confidence,
        risk_score=risk_report["risk_score"],
        category=category
    )
    db.add(db_claim)
    db.commit()
    db.refresh(db_claim)

    for s in sources:
        db_evidence = EvidenceRecord(
            claim_id=db_claim.id,
            url=s.url,
            title=s.title,
            snippet=s.title
        )
        db.add(db_evidence)
    db.commit()

    risk_metrics = RiskMetrics(
        fear_level=risk_report["metrics"]["fear_level"],
        urgency_level=risk_report["metrics"]["urgency_level"],
        conspiracy_level=risk_report["metrics"]["conspiracy_level"],
        total_risk_score=risk_report["risk_score"]
    )

    return VerifyResponse(
        verdict=verdict,
        confidence=confidence,
        reasoning=synthesis.get("reasoning", "Analysis complete."),
        translated_text=translated_text if translated_text != raw_text else None,
        category=category,
        risk_metrics=risk_metrics,
        sources=sources[:5],
        threat_card=threat_card,
        stance=stance_data.get("stance", "NEUTRAL"),
        emotional_tone=stance_data.get("emotional_tone", "Neutral")
    )

@app.get("/api/stats")
async def get_stats(db: Session = Depends(get_db)):
    total_claims = db.query(ClaimRecord).count()
    risk_avg = db.query(ClaimRecord).with_entities(ClaimRecord.risk_score).all()
    avg_risk = sum([r[0] for r in risk_avg]) / max(total_claims, 1)

    categories = db.query(ClaimRecord.category).distinct().all()
    cat_counts = []
    for (cat,) in categories:
        count = db.query(ClaimRecord).filter(ClaimRecord.category == cat).count()
        cat_counts.append({"name": cat, "value": count})

    return {
        "total_claims": total_claims,
        "average_risk": round(avg_risk, 2),
        "system_health": "Optimal",
        "category_distribution": cat_counts or [{"name": "General", "value": total_claims}]
    }

@app.get("/api/latest_claims")
async def get_latest_claims(db: Session = Depends(get_db)):
    claims = db.query(ClaimRecord).order_by(ClaimRecord.timestamp.desc()).limit(10).all()
    return claims

MOCK_RUMORS = [
    {"text": "WHO confirms new airborne virus strain originating from polar ice caps", "lang": "English"},
    {"text": "Bhai log kal se bank account link nahi kiya toh saara paisa freeze ho jayega", "lang": "Hinglish"},
    {"text": "NASA satellite captures footage of alien mothership near Jupiter", "lang": "English"},
    {"text": "Breaking: Govt banning all social media apps starting midnight", "lang": "English"},
    {"text": "Nimbu paani and baking soda cures all forms of cancer instantly", "lang": "Hinglish"},
    {"text": "EVM machines found hacked in local election using bluetooth", "lang": "English"},
    {"text": "Deepfake alert: Prime Minister's speech on new tax laws is AI generated", "lang": "English"},
    {"text": "Rs 500 notes with star mark are counterfeit, RBI warning", "lang": "Hinglish"},
    {"text": "Solar flare expected to wipe out global internet tomorrow", "lang": "English"},
    {"text": "Local tap water poisoned by rival political party in Sector 4", "lang": "English"}
]

@app.get("/api/web_rumors")
async def get_web_rumors():
    import random
    from datetime import datetime
    
    num_rumors = random.randint(5, 8)
    selected_rumors = random.sample(MOCK_RUMORS, num_rumors)
    
    rumors = []
    for item in selected_rumors:
        rumors.append({
            "id": random.randint(1000, 9999),
            "text": item["text"],
            "translated_text": item["text"] if item["lang"] == "English" else f"[Translated] {item['text']}",
            "verdict": random.choice(["FALSE", "LIKELY FALSE", "UNVERIFIABLE", "MIXED"]),
            "confidence": round(random.uniform(0.4, 0.95), 2),
            "risk_score": random.randint(60, 95),
            "category": random.choice(["Health", "Politics", "Finance", "Social", "General"]),
            "timestamp": datetime.now().isoformat()
        })
    return rumors

@app.post("/api/media/extract")
async def extract_media_claim(file: UploadFile = FastAPIFile(...)):
    file_bytes = await file.read()
    content_type = file.content_type or ""
    filename = file.filename or "upload"

    try:
        if content_type.startswith("image/"):
            claim = await media_service.extract_claim_from_image(file_bytes, content_type)
        elif content_type.startswith("audio/"):
            claim = await media_service.extract_claim_from_audio(file_bytes, filename)
        elif content_type.startswith("video/"):
            claim = await media_service.extract_claim_from_video(file_bytes, filename)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq extraction failed: {str(e)}")

    return {"claim": claim}

class URLRequest(BaseModel):
    url: str

@app.post("/api/media/extract-url")
async def extract_url_claim(body: URLRequest):
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL")
    try:
        claim = await media_service.extract_claim_from_url(url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"URL extraction failed: {str(e)}")
    return {"claim": claim}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
