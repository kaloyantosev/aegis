(function() {
  console.log("[TrueCharts TV Sync] Loaded!");

  let currentTicker = "";
  let currentData = null;

  // Create UI Container
  const container = document.createElement("div");
  container.id = "truecharts-tv-widget";
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 320px;
    background: rgba(10, 10, 10, 0.9);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(16, 185, 129, 0.1);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px;
    z-index: 999999;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `;

  // Inner styles for animations and layout
  const style = document.createElement("style");
  style.textContent = `
    #truecharts-tv-widget * { box-sizing: border-box; }
    .tc-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.03);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      cursor: pointer;
    }
    .tc-title {
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #10b981;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tc-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: max-height 0.3s ease;
      max-height: 500px;
    }
    .tc-body.collapsed {
      max-height: 0;
      padding: 0;
      overflow: hidden;
    }
    .tc-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
    }
    .tc-label {
      color: #a3a3a3;
    }
    .tc-value {
      font-family: monospace;
      font-weight: bold;
      color: #fff;
    }
    .tc-description {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 6px;
      padding: 8px;
      font-size: 11px;
      line-height: 1.4;
      color: #d4d4d4;
      max-height: 80px;
      overflow-y: auto;
    }
    .tc-btn {
      width: 100%;
      background: #10b981;
      border: none;
      color: #000;
      font-weight: 700;
      padding: 8px;
      border-radius: 6px;
      cursor: pointer;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .tc-btn:hover {
      background: #059669;
      transform: translateY(-1px);
    }
    .tc-btn:active {
      transform: translateY(0);
    }
    .tc-pulse {
      width: 6px;
      height: 6px;
      background: #10b981;
      border-radius: 50%;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.5); opacity: 0.4; }
      100% { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  // Initial Widget HTML
  container.innerHTML = `
    <div class="tc-header" id="tc-drag-header">
      <div class="tc-title">
        <div class="tc-pulse"></div>
        TrueCharts Sync
      </div>
      <span id="tc-toggle-btn" style="color: #a3a3a3; font-size: 12px; font-weight: bold;">[ − ]</span>
    </div>
    <div class="tc-body" id="tc-widget-body">
      <div id="tc-loading" style="text-align: center; color: #a3a3a3; padding: 20px 0;">
        Waiting for active chart...
      </div>
      <div id="tc-content" style="display: none; flex-direction: column; gap: 12px;">
        <div class="tc-row" style="border-bottom: 1px dashed rgba(255, 255, 255, 0.05); padding-bottom: 8px;">
          <span style="font-weight: 700; font-size: 14px; color: #10b981;" id="tc-active-ticker">-</span>
          <span style="font-family: monospace; font-size: 12px; font-weight: bold;" id="tc-active-spot">-</span>
        </div>
        <div class="tc-row">
          <span class="tc-label">Max Pain</span>
          <span class="tc-value" style="color: #c084fc;" id="tc-val-maxpain">-</span>
        </div>
        <div class="tc-row">
          <span class="tc-label">Support Level</span>
          <span class="tc-value" style="color: #f87171;" id="tc-val-support">-</span>
        </div>
        <div class="tc-row">
          <span class="tc-label">Resistance Level</span>
          <span class="tc-value" style="color: #34d399;" id="tc-val-resistance">-</span>
        </div>
        <div>
          <div class="tc-label" style="margin-bottom: 4px; font-size: 11px;">Trade Plan / Description</div>
          <div class="tc-description" id="tc-val-desc">-</div>
        </div>
        <button class="tc-btn" id="tc-autofill-btn">
          Auto-Fill Indicator
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  // Widget Toggle Expand/Collapse
  const header = container.querySelector("#tc-drag-header");
  const body = container.querySelector("#tc-widget-body");
  const toggleBtn = container.querySelector("#tc-toggle-btn");

  header.addEventListener("click", () => {
    body.classList.toggle("collapsed");
    toggleBtn.textContent = body.classList.contains("collapsed") ? "[ + ]" : "[ − ]";
  });

  // Watch Title for Ticker Changes
  const updateTicker = () => {
    const title = document.title;
    if (!title) return;
    const match = title.split(/[\s—\-]/)[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Valid stock symbol verification (1 to 5 characters, alphanumeric)
    if (match && match !== currentTicker && match.length >= 1 && match.length <= 5 && isNaN(match)) {
      currentTicker = match;
      console.log("[TrueCharts TV Sync] Chart ticker detected:", currentTicker);
      fetchOptionsData(currentTicker);
    }
  };

  const observer = new MutationObserver(updateTicker);
  const titleEl = document.querySelector("title");
  if (titleEl) {
    observer.observe(titleEl, { subtree: true, characterData: true, childList: true });
  }
  updateTicker(); // Trigger once on load

  // Fetch Options Data from Render API
  function fetchOptionsData(symbol) {
    const loadingEl = document.getElementById("tc-loading");
    const contentEl = document.getElementById("tc-content");
    
    loadingEl.style.display = "block";
    loadingEl.textContent = `Loading ${symbol} data...`;
    contentEl.style.display = "none";

    fetch(`https://truecharts.onrender.com/api/analyze/${symbol}`)
      .then(res => {
        if (!res.ok) throw new Error("Ticker not loaded in Render server");
        return res.json();
      })
      .then(data => {
        currentData = data;
        loadingEl.style.display = "none";
        contentEl.style.display = "flex";

        document.getElementById("tc-active-ticker").textContent = data.ticker;
        document.getElementById("tc-active-spot").textContent = `$${data.spot.toFixed(2)}`;
        document.getElementById("tc-val-maxpain").textContent = data.max_pain ? `$${data.max_pain.toFixed(2)}` : "—";
        document.getElementById("tc-val-support").textContent = (data.supports && data.supports[0]) ? `$${data.supports[0].toFixed(2)}` : "—";
        document.getElementById("tc-val-resistance").textContent = (data.resistances && data.resistances[0]) ? `$${data.resistances[0].toFixed(2)}` : "—";
        
        const rawDesc = (data.trade_ideas && data.trade_ideas[0]) ? data.trade_ideas[0] : "No description provided.";
        document.getElementById("tc-val-desc").textContent = rawDesc;
      })
      .catch(err => {
        loadingEl.style.display = "block";
        loadingEl.textContent = `No options data for ${symbol}`;
        contentEl.style.display = "none";
        currentData = null;
      });
  }

  // Auto-fill indicator settings logic
  document.getElementById("tc-autofill-btn").addEventListener("click", () => {
    if (!currentData) {
      alert("No options data loaded yet.");
      return;
    }
    
    // Find settings dialog container
    const dialogs = document.querySelectorAll('[class*="dialog"], [class*="popup"], [class*="dialog-content"]');
    if (dialogs.length === 0) {
      alert("Please double-click your 'Render Options Levels' indicator on the chart to open its settings dialog first.");
      return;
    }

    let foundAny = false;

    // Scan labels inside dialogs to map inputs
    const labels = document.querySelectorAll('span, label, td, div[class*="cell"]');
    labels.forEach(label => {
      const text = label.textContent.trim().toLowerCase();
      
      let targetVal = null;
      if (text === "max pain") {
        targetVal = currentData.max_pain;
      } else if (text === "support level") {
        targetVal = currentData.supports ? currentData.supports[0] : null;
      } else if (text === "resistance level") {
        targetVal = currentData.resistances ? currentData.resistances[0] : null;
      } else if (text === "trade description") {
        targetVal = currentData.trade_ideas ? currentData.trade_ideas[0] : null;
      }

      if (targetVal !== null) {
        const input = findSiblingInput(label);
        if (input) {
          input.value = targetVal;
          // Dispatch events so React state updates
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          foundAny = true;
        }
      }
    });

    if (foundAny) {
      // Find and click the 'OK' button to save dialog
      const okButtons = document.querySelectorAll('button[name="submit"], button[class*="ok"], button[class*="submit"], button[data-name="submit-button"]');
      okButtons.forEach(btn => {
        if (btn.textContent.trim().toLowerCase().includes("ok") || btn.textContent.trim().toLowerCase().includes("save")) {
          btn.click();
        }
      });
      console.log("[TrueCharts TV Sync] Settings auto-filled and saved successfully!");
    } else {
      alert("Autofill failed: Open indicator settings dialog first (Ensure field labels are: 'Max Pain', 'Support Level', 'Resistance Level', 'Trade Description')");
    }
  });

  // Helper to find input field next to label element
  function findSiblingInput(element) {
    // Traverse parent row or siblings
    let parent = element.parentElement;
    for (let depth = 0; depth < 4; depth++) {
      if (!parent) break;
      const input = parent.querySelector('input[type="text"], input[type="number"], textarea');
      if (input) return input;
      parent = parent.parentElement;
    }
    return null;
  }
})();
