import { h as head, b as attr, j as ensure_array_like, e as escape_html } from "../../../../../chunks/index2.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    function autoSave() {
      return;
    }
    let financialGoals = {
      targetSDE: 25e4,
      revenueY1: 95e4,
      revenueY3: 16e5,
      dailyTransactions: 500,
      avgTicket: 8.75,
      numberOfLocations: 1,
      startupCapital: 15e4,
      personalInvestment: 5e4,
      emergencyReserveMonths: 6,
      monthlyRentBudget: 15e3,
      buildoutBudget: 5e4,
      teamSize: 5,
      squareFootage: 1200
    };
    let spaceType = "Standard Cafe (800-1500 sqft)";
    let sqftMin = 1e3;
    let sqftMax = 1500;
    let monthlyRentBudget = 15e3;
    let neighborhoodCharacteristics = {
      highFootTraffic: true,
      residentialDensity: false,
      officeCommercial: false,
      fitnessWellness: true,
      familyFriendly: true,
      nightlifeEntertainment: false,
      trendyEmerging: false,
      establishedStable: false
    };
    let idealArea = "Chelsea";
    let visibilityPreferences = {
      groundFloor: true,
      cornerLocation: false,
      nearSubway: false,
      outdoorSeating: false
    };
    let locationPreferences = {
      numberOfTargetLocations: 1,
      preferredNeighborhoods: "Chelsea, Flatiron",
      maxCommuteTime: 30,
      minFootTrafficThreshold: 5e3
    };
    const neighborhoodAreasList = [
      "Chelsea",
      "Flatiron",
      "SoHo",
      "West Village",
      "East Village",
      "Tribeca",
      "NoHo / Nolita",
      "Midtown",
      "UWS / UES",
      "Gramercy / Murray Hill",
      "LES / Chinatown",
      "Williamsburg",
      "DUMBO / Cobble Hill",
      "Park Slope",
      "Other"
    ];
    head("uipxk1", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Concept: Your Numbers</title>`);
      });
    });
    $$renderer2.push(`<div class="page svelte-uipxk1"><div class="page-header svelte-uipxk1"><div class="breadcrumbs svelte-uipxk1"><a href="/app/vision/founder" class="breadcrumb completed svelte-uipxk1">✓ Founder</a> <span class="breadcrumb-arrow svelte-uipxk1">→</span> <a href="/app/vision/concept" class="breadcrumb completed svelte-uipxk1">✓ Concept</a> <span class="breadcrumb-arrow svelte-uipxk1">→</span> <a href="/app/vision/financial" class="breadcrumb active svelte-uipxk1">Financial</a> <span class="breadcrumb-arrow svelte-uipxk1">→</span> <a href="/app/vision/calibration" class="breadcrumb svelte-uipxk1">Calibration</a></div> <h1 class="svelte-uipxk1">YOUR NUMBERS</h1> <p class="subtitle svelte-uipxk1">Financial Goals &amp; Space Requirements</p></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="content svelte-uipxk1"><section class="section svelte-uipxk1"><div class="section-context-paragraph svelte-uipxk1">These numbers drive the entire feasibility analysis. Your take-home target determines how much revenue you need, which determines the location's foot traffic requirements. Be realistic — optimistic projections lead to bad lease decisions.</div> <div class="section-header svelte-uipxk1"><h2 class="svelte-uipxk1">Financial Goals</h2></div> <div class="section-content svelte-uipxk1"><div class="subsection svelte-uipxk1"><h3 class="subsection-title svelte-uipxk1">Revenue &amp; Profitability Targets</h3> <div class="grid grid-3col svelte-uipxk1"><div class="form-group svelte-uipxk1"><label for="sde" class="svelte-uipxk1">Owner's Take-Home (Year 1)</label> <input type="number" id="sde"${attr("value", financialGoals.targetSDE)} placeholder="250000" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">Your target seller discretionary earnings</span></div> <div class="form-group svelte-uipxk1"><label for="y1rev" class="svelte-uipxk1">Revenue Year 1</label> <input type="number" id="y1rev"${attr("value", financialGoals.revenueY1)} placeholder="950000" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">First-year total revenue target</span></div> <div class="form-group svelte-uipxk1"><label for="y3rev" class="svelte-uipxk1">Revenue Year 3</label> <input type="number" id="y3rev"${attr("value", financialGoals.revenueY3)} placeholder="1600000" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">Three-year revenue projection</span></div></div></div> <div class="subsection svelte-uipxk1"><h3 class="subsection-title svelte-uipxk1">Transaction Targets</h3> <div class="grid grid-2col svelte-uipxk1"><div class="form-group svelte-uipxk1"><label for="dtx" class="svelte-uipxk1">Daily Transactions</label> <input type="number" id="dtx"${attr("value", financialGoals.dailyTransactions)} placeholder="500" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">Drives foot traffic requirements and location scoring</span></div> <div class="form-group svelte-uipxk1"><label for="avgticket" class="svelte-uipxk1">Average Ticket Size</label> <input type="number" id="avgticket"${attr("value", financialGoals.avgTicket)} placeholder="8.75" step="0.01" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">Your average transaction value</span></div></div></div> <div class="subsection svelte-uipxk1"><h3 class="subsection-title svelte-uipxk1">Expansion &amp; Space Planning</h3> <div class="grid grid-3col svelte-uipxk1"><div class="form-group svelte-uipxk1"><label for="locations" class="svelte-uipxk1">Number of Target Locations</label> <input type="number" id="locations"${attr("value", financialGoals.numberOfLocations)} placeholder="1" min="1" max="10" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">Planning for multiple locations enables expansion sequencing</span></div> <div class="form-group svelte-uipxk1"><label for="sqft" class="svelte-uipxk1">Square Footage</label> <input type="number" id="sqft"${attr("value", financialGoals.squareFootage)} placeholder="1200" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">Target space size in square feet</span></div> <div class="form-group svelte-uipxk1"><label for="teamSize" class="svelte-uipxk1">Target Team Size</label> <input type="number" id="teamSize"${attr("value", financialGoals.teamSize)} placeholder="5" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">FTEs needed for first location</span></div></div></div> <div class="subsection svelte-uipxk1"><h3 class="subsection-title svelte-uipxk1">Investment &amp; Capital</h3> <div class="grid grid-3col svelte-uipxk1"><div class="form-group svelte-uipxk1"><label for="startupCapital" class="svelte-uipxk1">Total Startup Capital Available</label> <input type="number" id="startupCapital"${attr("value", financialGoals.startupCapital)} placeholder="150000" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">Total capital you can deploy</span></div> <div class="form-group svelte-uipxk1"><label for="personalInvestment" class="svelte-uipxk1">Personal Investment Amount</label> <input type="number" id="personalInvestment"${attr("value", financialGoals.personalInvestment)} placeholder="50000" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">Your personal equity in the deal</span></div> <div class="form-group svelte-uipxk1"><label for="emergencyReserve" class="svelte-uipxk1">Emergency Reserve (months)</label> <input type="number" id="emergencyReserve"${attr("value", financialGoals.emergencyReserveMonths)} placeholder="6" min="3" max="24" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">Months of operating expenses to reserve</span></div></div></div> <div class="subsection svelte-uipxk1"><h3 class="subsection-title svelte-uipxk1">Space &amp; Rent Budget</h3> <div class="grid grid-2col svelte-uipxk1"><div class="form-group svelte-uipxk1"><label for="rentBudget" class="svelte-uipxk1">Monthly Rent Budget</label> <input type="number" id="rentBudget"${attr("value", financialGoals.monthlyRentBudget)} placeholder="15000" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">Maximum acceptable monthly rent</span></div> <div class="form-group svelte-uipxk1"><label for="buildout" class="svelte-uipxk1">Buildout Budget</label> <input type="number" id="buildout"${attr("value", financialGoals.buildoutBudget)} placeholder="50000" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">Budget for tenant improvements</span></div></div></div></div></section> <section class="section svelte-uipxk1"><div class="section-context-paragraph svelte-uipxk1">Define your space requirements and neighborhood preferences. These constraints narrow the location scoring to only viable candidates for your business model.</div> <div class="section-header svelte-uipxk1"><h2 class="svelte-uipxk1">Your Ideal Space</h2></div> <div class="section-content svelte-uipxk1"><div class="grid grid-2col svelte-uipxk1"><div class="col svelte-uipxk1"><div class="form-group svelte-uipxk1"><label for="spaceType" class="svelte-uipxk1">Space Type</label> <input type="text" id="spaceType"${attr("value", spaceType)} placeholder="e.g., Standard Cafe (800-1500 sqft)" class="svelte-uipxk1"/></div> <div class="form-group svelte-uipxk1"><label for="sqftMin" class="svelte-uipxk1">Min Square Footage</label> <input type="number" id="sqftMin"${attr("value", sqftMin)} placeholder="1000" class="svelte-uipxk1"/></div> <div class="form-group svelte-uipxk1"><label for="sqftMax" class="svelte-uipxk1">Max Square Footage</label> <input type="number" id="sqftMax"${attr("value", sqftMax)} placeholder="1500" class="svelte-uipxk1"/></div> <div class="form-group svelte-uipxk1"><label for="rentBudget2" class="svelte-uipxk1">Monthly Rent Budget</label> <input type="number" id="rentBudget2"${attr("value", monthlyRentBudget)} placeholder="15000" class="svelte-uipxk1"/></div></div> <div class="col svelte-uipxk1"><div class="form-group svelte-uipxk1"><label style="margin-bottom: 0.6rem;" class="svelte-uipxk1">Neighborhood Characteristics</label> <div class="checkbox-grid svelte-uipxk1"><div class="checkbox-item svelte-uipxk1"><input type="checkbox" id="char-foot"${attr("checked", neighborhoodCharacteristics.highFootTraffic, true)} class="svelte-uipxk1"/> <label for="char-foot" class="svelte-uipxk1">High foot traffic</label></div> <div class="checkbox-item svelte-uipxk1"><input type="checkbox" id="char-res"${attr("checked", neighborhoodCharacteristics.residentialDensity, true)} class="svelte-uipxk1"/> <label for="char-res" class="svelte-uipxk1">Residential density</label></div> <div class="checkbox-item svelte-uipxk1"><input type="checkbox" id="char-office"${attr("checked", neighborhoodCharacteristics.officeCommercial, true)} class="svelte-uipxk1"/> <label for="char-office" class="svelte-uipxk1">Office/commercial</label></div> <div class="checkbox-item svelte-uipxk1"><input type="checkbox" id="char-fitness"${attr("checked", neighborhoodCharacteristics.fitnessWellness, true)} class="svelte-uipxk1"/> <label for="char-fitness" class="svelte-uipxk1">Fitness/wellness focus</label></div> <div class="checkbox-item svelte-uipxk1"><input type="checkbox" id="char-family"${attr("checked", neighborhoodCharacteristics.familyFriendly, true)} class="svelte-uipxk1"/> <label for="char-family" class="svelte-uipxk1">Family friendly</label></div> <div class="checkbox-item svelte-uipxk1"><input type="checkbox" id="char-nightlife"${attr("checked", neighborhoodCharacteristics.nightlifeEntertainment, true)} class="svelte-uipxk1"/> <label for="char-nightlife" class="svelte-uipxk1">Nightlife/entertainment</label></div> <div class="checkbox-item svelte-uipxk1"><input type="checkbox" id="char-trendy"${attr("checked", neighborhoodCharacteristics.trendyEmerging, true)} class="svelte-uipxk1"/> <label for="char-trendy" class="svelte-uipxk1">Trendy/emerging</label></div> <div class="checkbox-item svelte-uipxk1"><input type="checkbox" id="char-stable"${attr("checked", neighborhoodCharacteristics.establishedStable, true)} class="svelte-uipxk1"/> <label for="char-stable" class="svelte-uipxk1">Established/stable</label></div></div></div></div></div> <div class="form-group svelte-uipxk1" style="margin-top: 1rem;"><label for="idealArea" class="svelte-uipxk1">Ideal General Area</label> `);
    $$renderer2.select(
      {
        value: idealArea,
        id: "idealArea",
        onchange: autoSave,
        class: ""
      },
      ($$renderer3) => {
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(neighborhoodAreasList);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let area = each_array[$$index];
          $$renderer3.option({ value: area }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(area)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      },
      "svelte-uipxk1"
    );
    $$renderer2.push(`</div> <div class="form-group svelte-uipxk1"><label style="margin-bottom: 0.6rem; margin-top: 1rem;" class="svelte-uipxk1">Visibility Preferences</label> <div class="checkbox-grid svelte-uipxk1"><div class="checkbox-item svelte-uipxk1"><input type="checkbox" id="vis-ground"${attr("checked", visibilityPreferences.groundFloor, true)} class="svelte-uipxk1"/> <label for="vis-ground" class="svelte-uipxk1">Ground floor (street-level)</label></div> <div class="checkbox-item svelte-uipxk1"><input type="checkbox" id="vis-corner"${attr("checked", visibilityPreferences.cornerLocation, true)} class="svelte-uipxk1"/> <label for="vis-corner" class="svelte-uipxk1">Corner location</label></div> <div class="checkbox-item svelte-uipxk1"><input type="checkbox" id="vis-subway"${attr("checked", visibilityPreferences.nearSubway, true)} class="svelte-uipxk1"/> <label for="vis-subway" class="svelte-uipxk1">Near subway entrance</label></div> <div class="checkbox-item svelte-uipxk1"><input type="checkbox" id="vis-outdoor"${attr("checked", visibilityPreferences.outdoorSeating, true)} class="svelte-uipxk1"/> <label for="vis-outdoor" class="svelte-uipxk1">Outdoor seating potential</label></div></div></div></div></section> <section class="section svelte-uipxk1"><div class="section-context-paragraph svelte-uipxk1">Define your expansion and location search strategy. Multi-location planning unlocks different site profiles and economies of scale than single-site searches.</div> <div class="section-header svelte-uipxk1"><h2 class="svelte-uipxk1">Location Preferences</h2></div> <div class="section-content svelte-uipxk1"><div class="grid grid-2col svelte-uipxk1"><div class="form-group svelte-uipxk1"><label for="numLocations" class="svelte-uipxk1">Number of Target Locations (Expansion Plan)</label> <input type="number" id="numLocations"${attr("value", locationPreferences.numberOfTargetLocations)} placeholder="1" min="1" max="10" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">Planning for multiple locations enables our model to recommend expansion sequencing</span></div> <div class="form-group svelte-uipxk1"><label for="maxCommute" class="svelte-uipxk1">Max Commute Time (minutes)</label> <input type="number" id="maxCommute"${attr("value", locationPreferences.maxCommuteTime)} placeholder="30" min="5" max="120" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">Maximum acceptable commute from your base</span></div></div> <div class="grid grid-2col svelte-uipxk1"><div class="form-group svelte-uipxk1"><label for="neighborhoods" class="svelte-uipxk1">Preferred Neighborhoods (comma-separated)</label> <input type="text" id="neighborhoods"${attr("value", locationPreferences.preferredNeighborhoods)} placeholder="Chelsea, Flatiron, West Village" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">Focus your search geographically</span></div> <div class="form-group svelte-uipxk1"><label for="footTraffic" class="svelte-uipxk1">Minimum Foot Traffic Threshold (daily)</label> <input type="number" id="footTraffic"${attr("value", locationPreferences.minFootTrafficThreshold)} placeholder="5000" min="1000" step="500" class="svelte-uipxk1"/> <span class="input-helper svelte-uipxk1">Minimum daily pedestrian traffic to qualify</span></div></div></div></section> <div class="nav-footer svelte-uipxk1"><a href="/app/vision/concept" class="nav-link svelte-uipxk1">← Back: Concept</a> <a href="/app/vision/calibration" class="nav-link primary svelte-uipxk1">Next: Calibration →</a></div></div></div>`);
  });
}
export {
  _page as default
};
