"""
Coffee Recalibration Engine - Production API Diagnostic Tool
==========================================================
Replicates the production scoring by calling the local SvelteKit dev server directly.
This guarantees 100% parity with the real application, using paid APIs (Google, Foursquare)
and the real Supabase block group data.

Requires the SvelteKit dev server to be running: `npm run dev`

Usage:
    python test_coffee_score.py "600 6th Avenue, New York, NY 10011"
"""

import sys
import json
import requests
import time
import os
import re
import datetime
import pandas as pd

# ===================================================================
# CONFIGURATION
# ===================================================================

DEFAULT_ADDRESS = "600 6th Avenue, New York, NY 10011"
AVG_TICKET = 9.50
VISION_TIER = "highly_differentiated"

API_URL = "http://localhost:5173/api/location-iq"

# ===================================================================
# HELPER FUNCTIONS
# ===================================================================

def geocode(address):
    """Geocode via OpenStreetMap Nominatim."""
    print(f"  Geocoding: {address}...")
    resp = requests.get("https://nominatim.openstreetmap.org/search", params={
        "q": address, "format": "json", "limit": 1
    }, headers={"User-Agent": "RE2-Coffee-Tester/1.0"})
    results = resp.json()
    if not results:
        raise ValueError(f"Could not geocode: {address}")
    return float(results[0]["lat"]), float(results[0]["lon"])

def fetch_production_score(lat, lng, concept, avg_ticket, vision_tier):
    """Call the local RE2 SvelteKit dev server."""
    print(f"\n  Fetching full production score from {API_URL}...")
    print(f"  (This may take 5-15 seconds as it hits Google, Foursquare, and Supabase)")
    
    params = {
        "lat": lat,
        "lng": lng,
        "type": concept,
        "avgTicket": avg_ticket,
        "visionTier": vision_tier,
        "refresh": "true" # Force bypass cache
    }
    
    start_time = time.time()
    resp = requests.get(API_URL, params=params)
    duration = time.time() - start_time
    
    if resp.status_code != 200:
        print(f"\n  [ERROR] Backend returned {resp.status_code}")
        print(f"  Body: {resp.text}")
        print(f"  Is your dev server running? (npm run dev)")
        sys.exit(1)
        
    print(f"  Completed in {duration:.1f}s\n")
    return resp.json()

def ask_vision_questions(concept):
    print(f"\n{'='*60}")
    print("  VISION QUESTIONNAIRE")
    print(f"{'='*60}")
    
    if concept != "specialty_coffee":
        print(f"  (Vision questionnaire not yet implemented in script for '{concept}')")
        print("  Skipping dynamic vision calculation...\n")
        return {}
        
    # coffee_price
    print("\n1. What's your price point for a typical drink?")
    print("  [budget]  Under $5 (drip, basic espresso)")
    print("  [mid]     $5-8 (specialty lattes, single origin)")
    print("  [premium] $8-15 (pour-over bar, rare beans, tasting flights)")
    price = input("  > ").strip().lower()
    
    # coffee_format
    print("\n2. What's the format?")
    print("  [grab_go] Grab-and-go / walk-up window / cart")
    print("  [cafe]    Café with seating (15-40 seats)")
    print("  [roastery] Roastery / tasting room / destination café")
    fmt = input("  > ").strip().lower()
    
    # coffee_hours
    print("\n3. What hours are you planning?")
    print("  [morning] Early morning to early afternoon (6am-2pm)")
    print("  [allday]  Full day (6am-8pm)")
    print("  [late]    Extended hours including evening (6am-10pm+)")
    hours = input("  > ").strip().lower()
    
    return {
        "coffee_price": price if price in ["budget", "mid", "premium"] else "mid",
        "coffee_format": fmt if fmt in ["grab_go", "cafe", "roastery"] else "cafe",
        "coffee_hours": hours if hours in ["morning", "allday", "late"] else "allday"
    }

def fetch_dynamic_vision(lat, lng, concept, concept_answers, location_iq, indices):
    # Pass the scores from the GET call back to the POST
    index_scores = {k: v.get("score", 50) for k, v in indices.items() if isinstance(v, dict)}
    
    payload = {
        "lat": lat,
        "lng": lng,
        "businessType": concept,
        "conceptAnswers": concept_answers,
        "indexScores": index_scores,
        "locationIQScore": location_iq
    }
    
    print(f"\n  Fetching Dynamic Fit IQ from POST {API_URL}...")
    start_time = time.time()
    resp = requests.post(API_URL, json=payload)
    duration = time.time() - start_time
    
    if resp.status_code != 200:
        print(f"  [ERROR] POST returned {resp.status_code}")
        print(f"  Body: {resp.text}")
        return None
        
    print(f"  Completed in {duration:.1f}s\n")
    return resp.json()

def export_to_excel(get_data, post_data, address, concept, lat, lng, answers, extra_inputs):
    out_dir = r"C:\sandbox_re_squared\DataTesting"
    os.makedirs(out_dir, exist_ok=True)
    
    # Sanitize address for filename (e.g. "1 Manhattan West" -> "1_Manhattan_West")
    safe_addr = re.sub(r'[^\w\s-]', '', address).strip().replace(' ', '_')
    # If the address is too long, take the first part
    safe_addr = safe_addr.split('_New_York')[0] if '_New_York' in safe_addr else safe_addr
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{safe_addr}_{concept}_{timestamp}.xlsx"
    filepath = os.path.join(out_dir, filename)
    
    DATA_SOURCES = {
        "Transit": "MTA Ridership / Google Places",
        "Demographics": "US Census Bureau",
        "Competition": "Overpass API / Google Places",
        "Vibrancy": "Google Places / US Census",
        "Safety": "NYPD / NYCOpenData",
        "Momentum": "RE² Historical Data",
        "Neighborhoodhealth": "RE² Block Group Data",
        "Survivalrate": "DOHMH (NYC Dept of Health)",
        
        "morningRaw": "MTA Ridership",
        "dailyCustomers": "US Census Bureau / Google Places",
        "tierCompetitors": "Overpass API / Google Places",
        "sentiment": "RE² Canonical Engine",
        "competitionGap": "RE² Canonical Engine",
        
        "Location IQ": "RE² Composite (20 sources)",
        "Vision IQ": "Dynamic Questionnaire / RE² Logic",
        "Canonical Fit IQ": "RE² Canonical Engine (Blend)",
        "Historical Fit IQ": "RE² Precomputed Database"
    }

    def get_source(param_name):
        return DATA_SOURCES.get(param_name, "RE² Canonical Engine")
    
    rows = []
    
    # 0. Inputs & Metadata
    rows.append({"Category": "Test Inputs", "Parameter": "Address", "Value": address, "Score": "", "Data Source": "User Input"})
    rows.append({"Category": "Test Inputs", "Parameter": "Coordinates", "Value": f"{lat}, {lng}", "Score": "", "Data Source": "Geocoding"})
    rows.append({"Category": "Test Inputs", "Parameter": "Concept Type", "Value": concept, "Score": "", "Data Source": "User Input"})
    
    if extra_inputs:
        for k, v in extra_inputs.items():
            rows.append({"Category": "Test Inputs (General)", "Parameter": k, "Value": str(v), "Score": "", "Data Source": "User Input"})
    
    if answers:
        for q, ans in answers.items():
            rows.append({"Category": "Test Inputs (Vision)", "Parameter": q, "Value": ans, "Score": "", "Data Source": "User Input"})
            
    six_index = get_data.get("sixIndex", {})
    indices = six_index.get("indices", {})
    coffee_dims = six_index.get("coffeeDimRawData", {})
    
    # 1. Location / Six Index Base Parameters
    for key, data in indices.items():
        if isinstance(data, dict):
            rows.append({
                "Category": "Location Indices",
                "Parameter": key.capitalize(),
                "Value": data.get("value", ""),
                "Score": data.get("score", ""),
                "Data Source": get_source(key.capitalize())
            })
            
    # 2. Raw Dimensions
    for key, val in coffee_dims.items():
        if not isinstance(val, (dict, list)):
            rows.append({
                "Category": "Raw Intel Data",
                "Parameter": key,
                "Value": val,
                "Score": "",
                "Data Source": get_source(key)
            })
            
    # 3. Output Scores
    rows.append({
        "Category": "Final Output",
        "Parameter": "Location IQ",
        "Value": "Real Estate Composite",
        "Score": get_data.get("sixIndex", {}).get("locationIQ", ""),
        "Data Source": get_source("Location IQ")
    })
            
    if post_data:
        vision_iq = post_data.get("visionIQ", {})
        rows.append({
            "Category": "Final Output",
            "Parameter": "Vision IQ",
            "Value": "Dynamic (From Questionnaire)",
            "Score": vision_iq.get("score", ""),
            "Data Source": get_source("Vision IQ")
        })
        
        weights = vision_iq.get("weights", {})
        for w_k, w_v in weights.items():
             rows.append({
                "Category": "Dynamic Vision Weights",
                "Parameter": w_k,
                "Value": f"{round(w_v*100, 1)}%",
                "Score": "",
                "Data Source": "RE² Dynamic Concept Config"
            })
            
        fit_iq = post_data.get("fitIQ", {})
        rows.append({
            "Category": "Final Output",
            "Parameter": "Canonical Fit IQ",
            "Value": "Location * 0.60 + Vision * 0.40",
            "Score": fit_iq.get("score", ""),
            "Data Source": get_source("Canonical Fit IQ")
        })
    else:
        rows.append({
            "Category": "Final Output",
            "Parameter": "Historical Fit IQ",
            "Value": "Precomputed Baseline",
            "Score": get_data.get("fitIQ", ""),
            "Data Source": get_source("Historical Fit IQ")
        })
        
    df_main = pd.DataFrame(rows)
    
    # --- Tab 2: Watch Outs ---
    watch_outs = six_index.get("coffeeWatchOuts", [])
    watch_out_rows = []
    for w in watch_outs:
        watch_out_rows.append({
            "Title": w.get("title", ""),
            "Explanation": w.get("explanation", ""),
            "Index": w.get("index", "")
        })
    df_watchouts = pd.DataFrame(watch_out_rows) if watch_out_rows else pd.DataFrame([{"Message": "No Watch-Outs Triggered"}])
    
    # --- Tab 3: Sub-Dimensions (Breakdowns) ---
    breakdown_rows = []
    ritual_breakdown = coffee_dims.get("ritualBreakdown", [])
    for b in ritual_breakdown:
        breakdown_rows.append({
            "Dimension": "Daily Ritual",
            "Type": b.get("type", ""),
            "Count / Base": b.get("count", ""),
            "Estimated Daily Pop": b.get("dailyPop", "")
        })
        
    # We can also add other breakdowns here if available
    df_breakdowns = pd.DataFrame(breakdown_rows) if breakdown_rows else pd.DataFrame([{"Message": "No sub-breakdowns available"}])
    
    # --- Tab 4: Confidence Scores ---
    confidence_data = get_data.get("confidence", {})
    confidence_rows = []
    score_conf = confidence_data.get("scoreConfidence", "")
    reason = confidence_data.get("scoreConfidenceReason", "")
    confidence_rows.append({
        "Metric": "Overall Score Confidence",
        "Value": score_conf,
        "Details": reason
    })
    
    by_source = confidence_data.get("confidenceBySource", {})
    for src_k, src_v in by_source.items():
        confidence_rows.append({
            "Metric": f"Source: {src_k.capitalize()}",
            "Value": f"{src_v*100}%" if isinstance(src_v, (int, float)) else src_v,
            "Details": ""
        })
    
    # If POST data has an updated confidence, add it
    if post_data and "confidenceBySource" in post_data:
        post_conf = post_data.get("confidenceBySource", {})
        for src_k, src_v in post_conf.items():
            confidence_rows.append({
                "Metric": f"Dynamic Source: {src_k.capitalize()}",
                "Value": f"{src_v*100}%" if isinstance(src_v, (int, float)) else src_v,
                "Details": "From Questionnaire"
            })
            
    df_confidence = pd.DataFrame(confidence_rows) if confidence_rows else pd.DataFrame([{"Message": "No Confidence Data"}])
        
    # Write to Excel
    with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
        df_main.to_excel(writer, sheet_name='Scoring & Inputs', index=False)
        df_watchouts.to_excel(writer, sheet_name='Watch-Outs', index=False)
        df_breakdowns.to_excel(writer, sheet_name='Sub-Dimensions', index=False)
        df_confidence.to_excel(writer, sheet_name='Confidence', index=False)
        
    print(f"  [EXCEL] Data breakdown saved to: {filepath}\n")
    return filepath

# ===================================================================
# MAIN
# ===================================================================

def main():
    address = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ADDRESS

    print(f"\n{'='*60}")
    print(f"  RE² ENGINE - Production API Diagnostic")
    print(f"{'='*60}")
    
    # Prompt for business type
    print("What kind of business are you opening?")
    print("  Options: specialty_coffee, juice_bar, full_service_restaurant, qsr, bakery, fitness_studio, etc.")
    concept = input("  > ").strip().lower()
    if not concept:
        concept = "specialty_coffee"
        print("  (Defaulting to specialty_coffee)")
        
    print("\nWhat's your price positioning? (e.g. budget, mid, premium, luxury)")
    price_pos = input("  > ").strip()
    
    print("\nWhat is your core differentiator? (e.g. speed, quality, community, aesthetics)")
    differentiator = input("  > ").strip()
    
    print("\nHow would you describe your concept's uniqueness? (commodity / differentiated / highly_differentiated)")
    vision_tier = input("  > ").strip()
    if not vision_tier:
        vision_tier = VISION_TIER
        print(f"  (Defaulting to {vision_tier})")
        
    print("\nWhat is your average ticket price? (e.g. 9.50)")
    avg_ticket_input = input("  > ").strip()
    avg_ticket = float(avg_ticket_input) if avg_ticket_input else AVG_TICKET
    
    print("\nWhat's your rough budget to get started? (e.g. 150000)")
    budget = input("  > ").strip()
    
    print("\nMax monthly rent you'd pay? (e.g. 8000)")
    rent = input("  > ").strip()
    
    extra_inputs = {
        "Price Positioning": price_pos,
        "Differentiator": differentiator,
        "Concept Uniqueness (Vision Tier)": vision_tier,
        "Avg Ticket Price": avg_ticket,
        "Startup Budget": budget,
        "Max Monthly Rent": rent
    }
        
    print(f"\n{'='*60}")
    print(f"  Address:    {address}")
    print(f"  Concept:    {concept}")
    print(f"  Avg Ticket: ${avg_ticket:.2f}")
    print(f"  Vision:     {vision_tier}")
    print(f"{'='*60}\n")

    lat, lng = geocode(address)
    
    # Hit the exact same API the frontend uses
    data = fetch_production_score(lat, lng, concept, avg_ticket, vision_tier)
    
    # Extract data from the SixIndexReport structure
    six_index = data.get("sixIndex", {})
    location_iq = six_index.get("locationIQ", "--")
    grade = six_index.get("grade", "--")
    fit_iq = data.get("fitIQ", "--")
    
    # The new coffee dimensions raw output
    coffee_dims = six_index.get("coffeeDimRawData", {})
    coffee_scores = six_index.get("coffeeDimensions", {})
    
    # The mapped deep dive indices
    indices = six_index.get("indices", {})

    print(f"\n{'='*60}")
    print(f"  PRODUCTION RESULTS (From Backend)")
    print(f"{'='*60}")
    print(f"\n  {'Dimension':<28} {'Score':>6}")
    print(f"  {'-'*28} {'-'*6}")
    
    # Print the 6 mapped scores as they appear in the UI / DB
    transit = indices.get("transit", {}).get("score", "--")
    vibrancy = indices.get("vibrancy", {}).get("score", "--")
    comp = indices.get("competition", {}).get("score", "--")
    demographics = indices.get("demographics", {}).get("score", "--")
    safety = indices.get("safety", {}).get("score", "--")
    survival = indices.get("survivalRate", {}).get("score", "--")
    
    print(f"  1. Morning Foot Traffic     {transit:>6}")
    if "morningRaw" in coffee_dims:
        print(f"     (morning raw: {coffee_dims['morningRaw']:,})")
        
    print(f"  2. Daily Ritual Density     {vibrancy:>6}")
    if "dailyCustomers" in coffee_dims:
        print(f"     (est. {coffee_dims['dailyCustomers']:,} daily customers)")
        
    print(f"  3. Competition Context      {comp:>6}")
    if "tierCompetitors" in coffee_dims:
        print(f"     ({coffee_dims['tierCompetitors']} tier competitors, sentiment: {coffee_dims.get('sentiment', 'N/A')})")
        
    print(f"  4. Street-Side Quality      {safety:>6}")
    print(f"  5. Demographics Fit         {demographics:>6}")
    print(f"  6. Business Success Rate    {survival:>6} (Informational)")
    
    print(f"  {'-'*28} {'-'*6}")
    raw_comp = coffee_scores.get("rawComposite", "--")
    vm = coffee_scores.get("visionMultiplier", 1.0)
    
    print(f"  Raw Composite:              {raw_comp:>6}")
    print(f"  Vision Multiplier:          x{vm:.2f} ({VISION_TIER})")
    print(f"  {'='*28} {'='*6}")
    print(f"  LOCATION IQ:                {location_iq:>6}   Grade: {grade}")
    print(f"  BASELINE FIT IQ:            {fit_iq:>6}   (Historical default)")

    # Save raw GET results
    with open("score_result.json", "w") as f:
        json.dump(data, f, indent=2)
    print(f"\n  Raw GET payload saved to score_result.json")

    # Interactive Vision Questionnaire
    answers = ask_vision_questions(concept)
    
    if answers:
        post_data = fetch_dynamic_vision(lat, lng, concept, answers, location_iq, indices)
        if post_data:
            dyn_fit_iq = post_data.get("fitIQ", {}).get("score", "--")
            dyn_vision_iq = post_data.get("visionIQ", {}).get("score", "--")
            
            print(f"\n{'='*60}")
            print(f"  DYNAMIC SCORING RESULTS (Canonical Formula)")
            print(f"{'='*60}")
            print(f"  Location IQ: {location_iq:>6}")
            print(f"  Vision IQ:   {dyn_vision_iq:>6}   (Based on your answers)")
            print(f"  {'='*28}")
            print(f"  DYNAMIC FIT IQ: {dyn_fit_iq:>6}   (Location x 0.60 + Vision x 0.40)")
            print(f"{'='*60}\n")
            
            # Save POST results
            with open("post_result.json", "w") as f:
                json.dump(post_data, f, indent=2)
            print(f"  Raw POST payload saved to post_result.json\n")
            
            # Export to Excel
            export_to_excel(data, post_data, address, concept, lat, lng, answers, extra_inputs)
        else:
            export_to_excel(data, None, address, concept, lat, lng, None, extra_inputs)
    else:
        # Export to Excel without dynamic vision
        export_to_excel(data, None, address, concept, lat, lng, None, extra_inputs)

if __name__ == "__main__":
    main()
