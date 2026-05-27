<script lang="ts">
  // Static MVP banner — no backend action yet.
  // Post-MVP: connect Join Waitlist to email capture or waitlist API.
</script>

<div class="marketplace-banner">
  <div class="banner-text">
    <h3 class="banner-heading">Stuck on a step?</h3>
    <p class="banner-sub">
      RE²D2 can walk you through it — permits, leases, timelines, whatever's next.
    </p>
  </div>
  <a class="marketplace-btn" href="/app/dashboard">
    Ask RE²D2 →
  </a>
</div>

<style>
  .marketplace-banner {
    background: linear-gradient(135deg, #1B3A5C 0%, #2a5a8c 100%);
    border-radius: 12px;
    padding: 18px 22px;
    color: #fff;
    margin: 20px 0 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .banner-heading {
    font-family: 'DM Sans', sans-serif;
    font-size: 17px;
    font-weight: 700;
    margin: 0 0 4px;
  }

  .banner-sub {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    opacity: 0.85;
    margin: 0;
    max-width: 520px;
    line-height: 1.5;
  }

  .marketplace-btn {
    padding: 9px 18px;
    background: #fff;
    color: #1B3A5C;
    border: none;
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: opacity 0.15s;
    text-decoration: none;
    display: inline-block;
  }

  .marketplace-btn:hover { opacity: 0.9; }

  @media print {
    .marketplace-banner { display: none; }
  }
</style>
